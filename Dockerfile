FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY css/style.css /usr/share/nginx/html/css/style.css
COPY js/ /usr/share/nginx/html/js/

EXPOSE 80
