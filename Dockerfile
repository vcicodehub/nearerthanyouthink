FROM nginx:alpine
COPY gzip.conf /etc/nginx/conf.d/gzip.conf
COPY site.conf /etc/nginx/conf.d/default.conf
COPY index.html favicon.svg favicon-32.png apple-touch-icon.png /usr/share/nginx/html/
COPY icons/ /usr/share/nginx/html/icons/
EXPOSE 80
