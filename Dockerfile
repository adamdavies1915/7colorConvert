FROM nginx:alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create directories and copy static files
WORKDIR /usr/share/nginx/html
COPY --chmod=644 index.html .
COPY --chmod=644 health.html .
COPY --chmod=644 css/ ./css/
COPY --chmod=644 js/ ./js/

# Ensure all files are readable
RUN chmod -R 755 /usr/share/nginx/html

# Expose port 3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health.html || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
