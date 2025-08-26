FROM alekzonder/puppeteer:1.20.0
WORKDIR /app
COPY --chown=pptruser:pptruser ./server/ /app/
USER pptruser
RUN npm ci
ENTRYPOINT ["node", "index.js"]

