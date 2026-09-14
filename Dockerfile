FROM nginx:alpine

# The study app
COPY index.html /usr/share/nginx/html/index.html

# Railway provides the port at runtime, so template it into the nginx config
RUN printf '%s\n' \
  'server {' \
  '    listen $PORT;' \
  '    root /usr/share/nginx/html;' \
  '    index index.html;' \
  '    location / {' \
  '        try_files $uri $uri/ /index.html;' \
  '    }' \
  '}' > /etc/nginx/conf.d/default.conf.template

CMD ["/bin/sh", "-c", "envsubst '$$PORT' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
