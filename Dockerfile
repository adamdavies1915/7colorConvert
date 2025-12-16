FROM nginx:alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create directories and copy static files
WORKDIR /usr/share/nginx/html
COPY index.html .
COPY health.html .
COPY css/ ./css/
COPY js/ ./js/

# Expose port 3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health.html || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
