import fs from 'fs-extra';
import path from 'path';

const packageJsonPath = path.resolve('node_modules/kuuga-cli/package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as Record<string, string>;

export const dockerfileTemplate = `FROM node:22-slim

RUN apt-get update && \\
    apt-get install -y curl unzip jq git cron && \\
    curl -L -o kubo.tar.gz https://dist.ipfs.io/kubo/v0.25.0/kubo_v0.25.0_linux-amd64.tar.gz && \\
    tar -xzf kubo.tar.gz && \\
    cd kubo && \\
    mv ipfs /usr/local/bin/ && \\
    cd .. && \\
    rm -rf kubo kubo.tar.gz && \\
    apt-get clean && \\
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ARG KUUGA_KEY

COPY . .
RUN echo $KUUGA_KEY
RUN ipfs init
RUN npm i -g kuuga-cli@${packageJson.version}

EXPOSE 4001

CMD sh -c "ipfs daemon & sleep 10 && kuuga pin && while true; do sleep 3600; kuuga pin; done"
`;
