# Optional — "clean" deployment: serves the landing page + all variants.
# Use with Coolify build pack = "Dockerfile". Not required if you use the "Static" build pack.
FROM nginx:1.27-alpine

COPY index.html variants.json /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY variants /usr/share/nginx/html/variants

EXPOSE 80
