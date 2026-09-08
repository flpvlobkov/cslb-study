FROM nginx:alpine

# The study app
COPY index.html /usr/share/nginx/html/index.html

# Mobile polish: roomier line spacing so tappable words are easier to hit,
# slightly larger answer text, taller nav buttons, no sideways scroll.
RUN sed -i 's|</body>|<style>.q,.why{line-height:1.8}.opt{font-size:16px}nav button{padding:13px 0}*{-webkit-tap-highlight-color:rgba(30,79,216,0.18)}button,.gt,.opt{touch-action:manipulation}body{overflow-x:hidden}</style></body>|' /usr/share/nginx/html/index.html

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
