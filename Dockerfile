# Optional — for the "clean" deployment (only serves the site, not the .md/.git files).
# Use with Coolify build pack = "Dockerfile". Not required if you use the "Static" build pack.
FROM nginx:1.27-alpine

COPY index.html /usr/share/nginx/html/index.html
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY data /usr/share/nginx/html/data

EXPOSE 80
