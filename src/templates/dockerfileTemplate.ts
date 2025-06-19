export const dockerfileTemplate = `FROM node:22-slim

RUN apt-get update && \
    apt-get install -y curl unzip jq git && \
    curl -O https://dist.ipfs.io/kubo/v0.25.0/kubo_v0.25.0_linux-amd64.tar.gz && \
    tar -xzf kubo_v0.25.0_linux-amd64.tar.gz && \
    mv kubo /usr/local/bin/ && \
    rm kubo_v0.25.0_linux-amd64.tar.gz && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

RUN ipfs init
COPY publish.sh /publish.sh
RUN chmod +x /publish.sh

EXPOSE 4001

CMD sh -c "ipfs daemon & sleep 5 && /publish.sh"
`;
