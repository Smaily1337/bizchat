# Statyczny landing BizChat na Cloud Run (nginx, port 8080 wymagany przez Cloud Run)
FROM nginx:alpine

COPY . /usr/share/nginx/html
RUN rm -f /usr/share/nginx/html/Dockerfile \
    && sed -i 's/listen  *80;/listen 8080;/' /etc/nginx/conf.d/default.conf

EXPOSE 8080
