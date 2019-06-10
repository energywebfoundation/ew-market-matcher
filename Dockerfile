FROM node:10-alpine

USER root

RUN apk add --no-cache make gcc g++ openssh-client
RUN apk add --no-cache python git && \
    python -m ensurepip && \
    rm -r /usr/lib/python*/ensurepip && \
    pip install --upgrade pip setuptools && \
    rm -r /root/.cache

WORKDIR /src
COPY . /src

RUN npm config set unsafe-perm true && npm install
