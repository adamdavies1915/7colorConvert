/**
 * 7-Color E-Ink Converter - Main Application
 */

(function() {
    'use strict';

    // State
    const state = {
        images: new Map(), // Map of id -> { file, originalDataURL, converted, blob, outputFilename }
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
    const imagePopup = document.getElementById('imagePopup');
    const popupImage = document.getElementById('popupImage');

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

    // Create image card HTML
    function createImageCard(id, file, originalDataURL) {
        const card = document.createElement('div');
        card.className = 'image-card';
        card.id = `card-${id}`;
        card.innerHTML = `
            <div class="image-card-header">
                <span class="image-card-title" title="${file.name}">${file.name}</span>
                <span class="image-card-status" id="status-${id}">PENDING</span>
            </div>
            <div class="image-preview-container">
                <div class="preview-section">
                    <div class="preview-label">Original</div>
                    <img src="${originalDataURL}" class="preview-image" alt="Original">
                </div>
                <div class="preview-section">
                    <div class="preview-label">Converted</div>
                    <div class="preview-placeholder" id="preview-${id}">Awaiting conversion</div>
                </div>
            </div>
            <div class="image-card-actions">
                <button class="btn-small btn-primary" id="convert-${id}">CONVERT</button>
                <button class="btn-small btn-secondary" id="download-${id}" disabled>DOWNLOAD</button>
                <button class="btn-small btn-danger" id="remove-${id}">REMOVE</button>
            </div>
        `;

        // Event listeners
        card.querySelector(`#convert-${id}`).addEventListener('click', () => convertSingle(id));
        card.querySelector(`#download-${id}`).addEventListener('click', () => downloadSingle(id));
        card.querySelector(`#remove-${id}`).addEventListener('click', () => removeImage(id));

        return card;
    }

    // Add images to the grid
    async function addImages(files) {
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;

            const id = generateId();
            const originalDataURL = await readFileAsDataURL(file);

            state.images.set(id, {
                file: file,
                originalDataURL: originalDataURL,
                converted: false,
                blob: null,
                outputFilename: ImageConverter.getOutputFilename(file.name)
            });

            const card = createImageCard(id, file, originalDataURL);
            imageGrid.appendChild(card);
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
        const convertBtn = document.getElementById(`convert-${id}`);
        const downloadBtn = document.getElementById(`download-${id}`);

        try {
            statusEl.textContent = 'CONVERTING';
            statusEl.className = 'image-card-status';
            convertBtn.disabled = true;

            const result = await ImageConverter.convert(imageData.file);

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
            convertBtn.textContent = 'DONE';

        } catch (error) {
            console.error('Conversion error:', error);
            statusEl.textContent = 'ERROR';
            statusEl.classList.add('error');
            convertBtn.disabled = false;
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

    // Image hover popup
    imageGrid.addEventListener('mouseover', (e) => {
        if (e.target.classList.contains('preview-image')) {
            popupImage.src = e.target.src;
            imagePopup.classList.remove('hidden');
        }
    });

    imageGrid.addEventListener('mouseout', (e) => {
        if (e.target.classList.contains('preview-image')) {
            imagePopup.classList.add('hidden');
        }
    });

    imageGrid.addEventListener('mousemove', (e) => {
        if (!imagePopup.classList.contains('hidden')) {
            const padding = 20;
            let x = e.clientX + padding;
            let y = e.clientY + padding;

            // Get popup dimensions
            const popupRect = imagePopup.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Adjust if popup would go off-screen
            if (x + popupRect.width > viewportWidth - padding) {
                x = e.clientX - popupRect.width - padding;
            }
            if (y + popupRect.height > viewportHeight - padding) {
                y = e.clientY - popupRect.height - padding;
            }

            // Ensure popup doesn't go off left/top edge
            x = Math.max(padding, x);
            y = Math.max(padding, y);

            imagePopup.style.left = x + 'px';
            imagePopup.style.top = y + 'px';
        }
    });

})();
