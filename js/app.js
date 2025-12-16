/**
 * 7-Color E-Ink Converter - Main Application
 */

(function() {
    'use strict';

    // Constants
    const LANDSCAPE = { width: 800, height: 480 };
    const PORTRAIT = { width: 480, height: 800 };

    // State
    const state = {
        images: new Map(), // Map of id -> { file, originalDataURL, converted, blob, outputFilename, crop, orientation, imgWidth, imgHeight }
        converting: false
    };

    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const controls = document.getElementById('controls');
    const convertBtn = document.getElementById('convertBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const clearBtn = document.getElementById('clearBtn');
    const imageGrid = document.getElementById('imageGrid');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');

    // Generate unique ID
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Update UI based on state
    function updateUI() {
        const hasImages = state.images.size > 0;
        const allConverted = hasImages && Array.from(state.images.values()).every(img => img.converted);
        const anyConverted = hasImages && Array.from(state.images.values()).some(img => img.converted);

        controls.classList.toggle('hidden', !hasImages);
        downloadAllBtn.disabled = !anyConverted;
        convertBtn.disabled = state.converting || allConverted;

        if (state.converting) {
            convertBtn.textContent = 'CONVERTING...';
            convertBtn.classList.add('converting');
        } else {
            convertBtn.textContent = allConverted ? 'ALL CONVERTED' : 'CONVERT ALL';
            convertBtn.classList.remove('converting');
        }
    }

    // Get image dimensions
    function getImageDimensions(dataURL) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.src = dataURL;
        });
    }

    // Calculate initial crop area (centered, maximum size while maintaining aspect ratio)
    function calculateInitialCrop(imgWidth, imgHeight, orientation) {
        const target = orientation === 'landscape' ? LANDSCAPE : PORTRAIT;
        const aspectRatio = target.width / target.height;

        let cropWidth, cropHeight;

        if (imgWidth / imgHeight > aspectRatio) {
            // Image is wider than target aspect ratio
            cropHeight = imgHeight;
            cropWidth = cropHeight * aspectRatio;
        } else {
            // Image is taller than target aspect ratio
            cropWidth = imgWidth;
            cropHeight = cropWidth / aspectRatio;
        }

        return {
            x: (imgWidth - cropWidth) / 2,
            y: (imgHeight - cropHeight) / 2,
            width: cropWidth,
            height: cropHeight
        };
    }

    // Create image card HTML with crop editor
    function createImageCard(id, file, originalDataURL, imgWidth, imgHeight) {
        const orientation = imgWidth > imgHeight ? 'landscape' : 'portrait';
        const card = document.createElement('div');
        card.className = 'image-card';
        card.id = `card-${id}`;
        card.innerHTML = `
            <div class="image-card-header">
                <span class="image-card-title" title="${file.name}">${file.name}</span>
                <span class="image-card-status" id="status-${id}">PENDING</span>
            </div>
            <div class="crop-editor" id="crop-editor-${id}">
                <img src="${originalDataURL}" class="crop-editor-image" id="crop-image-${id}" alt="Original">
                <div class="crop-frame" id="crop-frame-${id}">
                    <span class="crop-frame-label" id="crop-label-${id}">800 x 480</span>
                </div>
            </div>
            <div class="orientation-toggle">
                <button class="orientation-btn ${orientation === 'landscape' ? 'active' : ''}" id="landscape-${id}" data-orientation="landscape">
                    Landscape (800x480)
                </button>
                <button class="orientation-btn ${orientation === 'portrait' ? 'active' : ''}" id="portrait-${id}" data-orientation="portrait">
                    Portrait (480x800)
                </button>
            </div>
            <div class="image-preview-container">
                <div class="preview-section">
                    <div class="preview-label">Preview</div>
                    <div class="preview-placeholder" id="preview-${id}">Adjust crop above, then convert</div>
                </div>
            </div>
            <div class="image-card-actions">
                <button class="btn-small btn-primary" id="convert-${id}">CONVERT</button>
                <button class="btn-small btn-secondary" id="download-${id}" disabled>DOWNLOAD</button>
                <button class="btn-small btn-danger" id="remove-${id}">REMOVE</button>
            </div>
        `;

        // Event listeners for buttons
        card.querySelector(`#convert-${id}`).addEventListener('click', () => convertSingle(id));
        card.querySelector(`#download-${id}`).addEventListener('click', () => downloadSingle(id));
        card.querySelector(`#remove-${id}`).addEventListener('click', () => removeImage(id));

        // Orientation toggle listeners
        card.querySelector(`#landscape-${id}`).addEventListener('click', () => setOrientation(id, 'landscape'));
        card.querySelector(`#portrait-${id}`).addEventListener('click', () => setOrientation(id, 'portrait'));

        return card;
    }

    // Initialize crop frame after card is added to DOM
    function initializeCropFrame(id) {
        const imageData = state.images.get(id);
        if (!imageData) return;

        const cropEditor = document.getElementById(`crop-editor-${id}`);
        const cropImage = document.getElementById(`crop-image-${id}`);
        const cropFrame = document.getElementById(`crop-frame-${id}`);

        // Wait for image to load and get displayed dimensions
        cropImage.onload = () => {
            updateCropFrame(id);
            setupCropDrag(id);
        };

        if (cropImage.complete) {
            updateCropFrame(id);
            setupCropDrag(id);
        }
    }

    // Update crop frame position and size
    function updateCropFrame(id) {
        const imageData = state.images.get(id);
        if (!imageData) return;

        const cropImage = document.getElementById(`crop-image-${id}`);
        const cropFrame = document.getElementById(`crop-frame-${id}`);
        const cropLabel = document.getElementById(`crop-label-${id}`);

        if (!cropImage || !cropFrame) return;

        // Get displayed image dimensions and position
        const imgRect = cropImage.getBoundingClientRect();
        const editorRect = cropImage.parentElement.getBoundingClientRect();

        // Calculate scale between original and displayed image
        const scaleX = imgRect.width / imageData.imgWidth;
        const scaleY = imgRect.height / imageData.imgHeight;

        // Calculate crop frame position in pixels relative to editor
        const offsetX = imgRect.left - editorRect.left;
        const offsetY = imgRect.top - editorRect.top;

        const frameLeft = offsetX + (imageData.crop.x * scaleX);
        const frameTop = offsetY + (imageData.crop.y * scaleY);
        const frameWidth = imageData.crop.width * scaleX;
        const frameHeight = imageData.crop.height * scaleY;

        cropFrame.style.left = frameLeft + 'px';
        cropFrame.style.top = frameTop + 'px';
        cropFrame.style.width = frameWidth + 'px';
        cropFrame.style.height = frameHeight + 'px';

        // Update label
        const target = imageData.orientation === 'landscape' ? LANDSCAPE : PORTRAIT;
        cropLabel.textContent = `${target.width} x ${target.height}`;
    }

    // Setup drag functionality for crop frame
    function setupCropDrag(id) {
        const cropFrame = document.getElementById(`crop-frame-${id}`);
        const cropImage = document.getElementById(`crop-image-${id}`);

        if (!cropFrame || !cropImage) return;

        let isDragging = false;
        let startX, startY;
        let startCropX, startCropY;

        cropFrame.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const imageData = state.images.get(id);
            startCropX = imageData.crop.x;
            startCropY = imageData.crop.y;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Touch support
        cropFrame.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isDragging = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;

            const imageData = state.images.get(id);
            startCropX = imageData.crop.x;
            startCropY = imageData.crop.y;

            document.addEventListener('touchmove', onTouchMove);
            document.addEventListener('touchend', onTouchEnd);
        });

        function onMouseMove(e) {
            if (!isDragging) return;
            handleDrag(e.clientX, e.clientY);
        }

        function onTouchMove(e) {
            if (!isDragging) return;
            handleDrag(e.touches[0].clientX, e.touches[0].clientY);
        }

        function handleDrag(clientX, clientY) {
            const imageData = state.images.get(id);
            if (!imageData) return;

            const imgRect = cropImage.getBoundingClientRect();
            const scaleX = imgRect.width / imageData.imgWidth;
            const scaleY = imgRect.height / imageData.imgHeight;

            // Calculate delta in original image coordinates
            const deltaX = (clientX - startX) / scaleX;
            const deltaY = (clientY - startY) / scaleY;

            // Calculate new position with bounds
            let newX = startCropX + deltaX;
            let newY = startCropY + deltaY;

            // Constrain to image bounds
            newX = Math.max(0, Math.min(newX, imageData.imgWidth - imageData.crop.width));
            newY = Math.max(0, Math.min(newY, imageData.imgHeight - imageData.crop.height));

            imageData.crop.x = newX;
            imageData.crop.y = newY;

            updateCropFrame(id);
        }

        function onMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        function onTouchEnd() {
            isDragging = false;
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        }
    }

    // Set orientation for an image
    function setOrientation(id, orientation) {
        const imageData = state.images.get(id);
        if (!imageData || imageData.converted) return;

        imageData.orientation = orientation;
        imageData.crop = calculateInitialCrop(imageData.imgWidth, imageData.imgHeight, orientation);

        // Update UI
        document.getElementById(`landscape-${id}`).classList.toggle('active', orientation === 'landscape');
        document.getElementById(`portrait-${id}`).classList.toggle('active', orientation === 'portrait');

        updateCropFrame(id);
    }

    // Add images to the grid
    async function addImages(files) {
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;

            const id = generateId();
            const originalDataURL = await readFileAsDataURL(file);
            const dimensions = await getImageDimensions(originalDataURL);

            const orientation = dimensions.width > dimensions.height ? 'landscape' : 'portrait';
            const crop = calculateInitialCrop(dimensions.width, dimensions.height, orientation);

            state.images.set(id, {
                file: file,
                originalDataURL: originalDataURL,
                converted: false,
                blob: null,
                outputFilename: ImageConverter.getOutputFilename(file.name),
                crop: crop,
                orientation: orientation,
                imgWidth: dimensions.width,
                imgHeight: dimensions.height
            });

            const card = createImageCard(id, file, originalDataURL, dimensions.width, dimensions.height);
            imageGrid.appendChild(card);

            // Initialize crop frame after DOM is ready
            requestAnimationFrame(() => initializeCropFrame(id));
        }

        updateUI();
    }

    // Read file as data URL
    function readFileAsDataURL(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    }

    // Convert single image
    async function convertSingle(id) {
        const imageData = state.images.get(id);
        if (!imageData || imageData.converted) return;

        const statusEl = document.getElementById(`status-${id}`);
        const previewEl = document.getElementById(`preview-${id}`);
        const convertBtnEl = document.getElementById(`convert-${id}`);
        const downloadBtn = document.getElementById(`download-${id}`);

        try {
            statusEl.textContent = 'CONVERTING';
            statusEl.className = 'image-card-status';
            convertBtnEl.disabled = true;

            // Pass crop and orientation to converter
            const result = await ImageConverter.convert(imageData.file, {
                crop: imageData.crop,
                orientation: imageData.orientation
            });

            // Update state
            imageData.converted = true;
            imageData.blob = result.blob;
            imageData.dataURL = result.dataURL;

            // Update UI
            statusEl.textContent = 'CONVERTED';
            statusEl.classList.add('converted');

            // Replace placeholder with image
            const img = document.createElement('img');
            img.src = result.dataURL;
            img.className = 'preview-image';
            img.alt = 'Converted';
            previewEl.parentNode.replaceChild(img, previewEl);

            downloadBtn.disabled = false;
            convertBtnEl.textContent = 'DONE';

        } catch (error) {
            console.error('Conversion error:', error);
            statusEl.textContent = 'ERROR';
            statusEl.classList.add('error');
            convertBtnEl.disabled = false;
        }

        updateUI();
    }

    // Convert all images
    async function convertAll() {
        if (state.converting) return;

        state.converting = true;
        updateUI();

        const unconverted = Array.from(state.images.entries())
            .filter(([_, data]) => !data.converted);

        progressBar.classList.remove('hidden');
        let completed = 0;

        for (const [id, _] of unconverted) {
            await convertSingle(id);
            completed++;
            const percent = Math.round((completed / unconverted.length) * 100);
            progressFill.style.width = `${percent}%`;
            progressText.textContent = `${percent}%`;
        }

        state.converting = false;
        progressBar.classList.add('hidden');
        progressFill.style.width = '0%';
        updateUI();
    }

    // Download single image
    function downloadSingle(id) {
        const imageData = state.images.get(id);
        if (!imageData || !imageData.blob) return;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(imageData.blob);
        link.download = imageData.outputFilename;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    // Download all as ZIP
    async function downloadAll() {
        const converted = Array.from(state.images.values())
            .filter(img => img.converted && img.blob);

        if (converted.length === 0) return;

        if (converted.length === 1) {
            // Single file, just download directly
            const link = document.createElement('a');
            link.href = URL.createObjectURL(converted[0].blob);
            link.download = converted[0].outputFilename;
            link.click();
            URL.revokeObjectURL(link.href);
            return;
        }

        // Multiple files, create ZIP
        const zip = new JSZip();

        for (const img of converted) {
            zip.file(img.outputFilename, img.blob);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = 'eink_images.zip';
        link.click();
        URL.revokeObjectURL(link.href);
    }

    // Remove single image
    function removeImage(id) {
        state.images.delete(id);
        const card = document.getElementById(`card-${id}`);
        if (card) card.remove();
        updateUI();
    }

    // Clear all images
    function clearAll() {
        state.images.clear();
        imageGrid.innerHTML = '';
        updateUI();
    }

    // Event Listeners

    // Drop zone click
    dropZone.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            addImages(Array.from(e.target.files));
            e.target.value = ''; // Reset for re-selection
        }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            addImages(files);
        }
    });

    // Control buttons
    convertBtn.addEventListener('click', convertAll);
    downloadAllBtn.addEventListener('click', downloadAll);
    clearBtn.addEventListener('click', clearAll);

    // Prevent default drag behavior on document
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());

    // Image click to open modal
    imageGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('preview-image')) {
            modalImage.src = e.target.src;
            imageModal.style.display = 'block';
        }
    });

    // Click modal to close
    imageModal.addEventListener('click', () => {
        imageModal.style.display = 'none';
        modalImage.src = '';
    });

    // Handle window resize - update all crop frames
    window.addEventListener('resize', () => {
        for (const [id] of state.images) {
            updateCropFrame(id);
        }
    });

})();
