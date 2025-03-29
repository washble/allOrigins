FROM node:current-slim
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY ./package.json /usr/src/app/
COPY ./package-lock.json /usr/src/app/
ENV NODE_ENV production
RUN npm ci --only=production
COPY . /usr/src/app
CMD [ "npm", "run", "start" ]
