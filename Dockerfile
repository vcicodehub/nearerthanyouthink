FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
COPY icons/ /usr/share/nginx/html/icons/
EXPOSE 80
