# Orbit AI

A responsive AI chat application packaged for Docker and Kubernetes. It uses the Anthropic Messages API (Claude) when `ANTHROPIC_API_KEY` is set and a local demo response otherwise.

## Run locally

```bash
export ANTHROPIC_API_KEY="your-key"
npm start
```

Open <http://localhost:3000>. Optional environment variables: `PORT`, `ANTHROPIC_MODEL`, and `SYSTEM_PROMPT`.

## Docker

```bash
docker build -t orbit-ai .
docker run --rm -p 3000:3000 -e ANTHROPIC_API_KEY orbit-ai
```

## Kubernetes

Update the image and hostname in `k8s/`, then:

```bash
kubectl create secret generic orbit-ai-secrets --from-literal=ANTHROPIC_API_KEY="your-key"
kubectl apply -f k8s/
```

Never commit an API key or put it directly in a Kubernetes manifest.
