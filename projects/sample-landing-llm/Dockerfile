# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS build

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

WORKDIR /workspace/guidify-ai/packages/vapi-studio
COPY --from=vapi-studio package.json tsconfig.json ./
COPY --from=vapi-studio src ./src
COPY --from=vapi-studio test ./test
COPY --from=vapi-studio scripts ./scripts
COPY --from=vapi-studio docs ./docs
COPY --from=vapi-studio agent ./agent
RUN yarn install && yarn build
RUN mkdir -p /pkg/vapi-studio && cp package.json /pkg/vapi-studio/ && cp -R dist /pkg/vapi-studio/dist && cp -R test /pkg/vapi-studio/test && cp -R scripts /pkg/vapi-studio/scripts && cp -R docs /pkg/vapi-studio/docs && cp -R agent /pkg/vapi-studio/agent
RUN rm -rf node_modules

WORKDIR /workspace/guidify-ai/projects/sample-landing-llm
COPY package.json tsconfig.json ./
COPY src ./src
COPY config ./config
COPY test ./test
RUN node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); p.dependencies['@guidify-ai/vapi-studio']='file:/pkg/vapi-studio'; fs.writeFileSync('package.json', JSON.stringify(p,null,2));" \
  && yarn install && yarn build

FROM node:24-bookworm-slim AS runtime
WORKDIR /workspace
COPY --from=build /pkg/vapi-studio /workspace/guidify-ai/packages/vapi-studio
COPY --from=build /workspace/guidify-ai/projects/sample-landing-llm /workspace/guidify-ai/projects/sample-landing-llm
RUN mkdir -p /pkg && ln -sfn /workspace/guidify-ai/packages/vapi-studio /pkg/vapi-studio
ENV NODE_ENV=production
ENV CONFIG_DIR=/workspace/guidify-ai/projects/sample-landing-llm/config
ENV PORT=9999
WORKDIR /workspace/guidify-ai/projects/sample-landing-llm
RUN mkdir -p logs
EXPOSE 9999
CMD ["node", "dist/main.js"]
