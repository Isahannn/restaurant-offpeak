FROM node:20-alpine
WORKDIR /workspace
COPY package.json package-lock.json* .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install
COPY . .
WORKDIR /workspace
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace", "apps/web"]
