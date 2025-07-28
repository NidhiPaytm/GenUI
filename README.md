# Generating UI

![Screenshot of app](./static/screenshot.png)

Generating UI is an open source web application that leverages AI agents to solve user problems by generating interactive UI interfaces. Built on top of [Open Canvas](https://github.com/langchain-ai/open-canvas), this project focuses specifically on transforming natural language requirements into functional user interfaces.

## Key Capabilities

1. **UI-First Problem Solving**: Generating UI specializes in understanding user problems and creating appropriate UI solutions, from simple forms to complex interactive components.
2. **Built on Open Canvas**: Inherits all the powerful features of Open Canvas including memory systems, reflection agents, and collaborative editing capabilities.
3. **Natural Language to UI**: Advanced pipeline that converts user descriptions into working UI code with proper state management and styling.
4. **Interactive Development**: Users can iterate on generated UIs through natural conversation, refining and enhancing the interface in real-time.

## Core Features

- **Intelligent UI Generation**: Automatically creates UI components and interfaces based on user requirements and problem descriptions
- **Memory-Powered Personalization**: Built-in memory system that remembers user preferences, design patterns, and UI requirements across sessions for more personalized experiences
- **Custom UI Quick Actions**: Define reusable UI patterns and components that can be applied with a single click, tailored to your specific needs
- **Pre-built UI Templates**: Comprehensive library of pre-built UI components and templates for common interface patterns
- **UI Version Control**: All generated UI artifacts have full version history, allowing you to explore different design iterations and revert to previous versions
- **Live Preview & Editing**: Real-time rendering of generated UI with seamless switching between code view and visual preview
- **Multi-Format Output**: Generate complete UI solutions including HTML, CSS, JavaScript, and documentation in a unified workflow

## Architecture Overview

# System Design

**Generating UI** is built on top of **Open Canvas**, extending its finite state machine architecture to focus specifically on UI generation workflows. The system operates through intelligent state transitions, where each state corresponds to a different phase of UI creation - from requirement analysis to final rendering.

The core state management is handled through `const builder = new StateGraph(OpenCanvasGraphAnnotation)` in `agents/src/open-canvas/index.ts`, with all user interactions flowing through the `generatePath` function. Each node in the system leverages Large Language Models (LLMs) to perform specialized UI generation tasks, with implementations located in `agents/src/open-canvas/nodes/` and prompts centralized in `agents/open-canvas/prompts.ts`.

# Enhanced UI Generation Pipeline

Building on Open Canvas's foundation, **Generating UI** introduces two key enhancements:

1. **Intelligent Requirements Analysis:**  
   Advanced logic that analyzes user problems and automatically determines the most appropriate UI solution, from simple components to complex interactive interfaces.

2. **Comprehensive UI Rendering Pipeline:**  
   A sophisticated rendering system that transforms generated UI code into fully functional, styled interfaces with proper state management and interactivity.

## Setup Locally

### Prerequisites

Generating UI requires the following API keys and external services:

#### Package Manager

- [Yarn](https://yarnpkg.com/)

#### APIs

- [OpenAI API key](https://platform.openai.com/signup/)
- [Anthropic API key](https://console.anthropic.com/)
- (optional) [Google GenAI API key](https://aistudio.google.com/apikey)
- (optional) [Fireworks AI API key](https://fireworks.ai/login)
- (optional) [Groq AI API key](https://groq.com) - audio/video transcription
- (optional) [FireCrawl API key](https://firecrawl.dev) - web scraping
- (optional) [ExaSearch API key](https://exa.ai) - web search


#### Authentication

- [Supabase](https://supabase.com/) account for authentication

#### LangGraph Server

- [LangGraph CLI](https://langchain-ai.github.io/langgraph/cloud/reference/cli/) for running the graph locally

#### LangSmith

- [LangSmith](https://smith.langchain.com/) for tracing & observability

### Installation

First, clone the repository:

```bash
git clone <your-generating-ui-repository-url>
cd generating-ui
```

Next, install the dependencies:

```bash
yarn install
```

After installing dependencies, copy the contents of both `.env.example` files in the root of the project, and in `apps/web` into `.env` and set the required values:

```bash
# The root `.env` file will be read by the LangGraph server for the agents.
cp .env.example .env
```

```bash
# The `apps/web/.env` file will be read by the frontend.
cd apps/web/
cp .env.example .env
```

Then, setup authentication with Supabase.

### Setup Authentication

After creating a Supabase account, visit your [dashboard](https://supabase.com/dashboard/projects) and create a new project.

Next, navigate to the `Project Settings` page inside your project, and then to the `API` tag. Copy the `Project URL`, and `anon public` project API key. Paste them into the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variables in the `apps/web/.env` file.

After this, navigate to the `Authentication` page, and the `Providers` tab. Make sure `Email` is enabled (also ensure you've enabled `Confirm Email`). You may also enable `GitHub`, and/or `Google` if you'd like to use those for authentication. (see these pages for documentation on how to setup each provider: [GitHub](https://supabase.com/docs/guides/auth/social-login/auth-github), [Google](https://supabase.com/docs/guides/auth/social-login/auth-google))

#### Test authentication

To verify authentication works, run `yarn dev` and visit [localhost:3000](http://localhost:3000). This should redirect you to the [login page](http://localhost:3000/auth/login). From here, you can either login with Google or GitHub, or if you did not configure these providers, navigate to the [signup page](http://localhost:3000/auth/signup) and create a new account with an email and password. This should then redirect you to a conformation page, and after confirming your email you should be redirected to the [home page](http://localhost:3000).

### Setup LangGraph Server

The first step to running Generating UI locally is to build the application. This is because Generating UI uses a monorepo setup, and requires workspace dependencies to be built so other packages/apps can access them.

Run the following command from the root of the repository:

```bash
yarn build
```

Now we'll cover how to setup and run the LangGraph server locally.

Navigate to `apps/agents` and run `yarn dev` (this runs `npx @langchain/langgraph-cli dev --port 54367`).

```
Ready!
- 🚀 API: http://localhost:54367
- 🎨 Studio UI: https://smith.langchain.com/studio?baseUrl=http://localhost:54367
```

After your LangGraph server is running, execute the following command inside `apps/web` to start the Generating UI frontend:

```bash
yarn dev
```

On initial load, compilation may take a little bit of time.

Then, open [localhost:3000](http://localhost:3000) with your browser and start generating UI!

## LLM Models

Generating UI is designed to be compatible with any LLM model. The current deployment has the following models configured:

- **Anthropic Claude 3 Haiku 👤**: Haiku is Anthropic's fastest model, great for quick tasks like making edits to your document. Sign up for an Anthropic account [here](https://console.anthropic.com/).
- **Fireworks Llama 3 70B 🦙**: Llama 3 is a SOTA open source model from Meta, powered by [Fireworks AI](https://fireworks.ai/). You can sign up for an account [here](https://fireworks.ai/login).
- **OpenAI GPT 4o Mini 💨**: GPT 4o Mini is OpenAI's newest, smallest model. You can sign up for an API key [here](https://platform.openai.com/signup/).

If you'd like to add a new model, follow these simple steps:

1. Add to or update the model provider variables in `packages/shared/src/models.ts`.
2. Install the necessary package for the provider (e.g. `@langchain/anthropic`) inside `apps/agents`.
3. Update the `getModelConfig` function in `apps/agents/src/agent/utils.ts` to include an `if` statement for your new model name and provider.
4. Manually test by checking you can:
   > - 4a. Generate a new artifact
   > - 4b. Generate a followup message (happens automatically after generating an artifact)
   > - 4c. Update an artifact via a message in chat
   > - 4d. Update an artifact via a quick action
   > - 4e. Repeat for text/code (ensure both work)

### Local Ollama models

Generating UI supports calling local LLMs running on Ollama. This is not enabled in the hosted version of Generating UI, but you can use this in your own local/deployed Generating UI instance.

To use a local Ollama model, first ensure you have [Ollama](https://ollama.com) installed, and a model that supports tool calling pulled (the default model is `llama3.3`).

Next, start the Ollama server by running `ollama run llama3.3`.

Then, set the `NEXT_PUBLIC_OLLAMA_ENABLED` environment variable to `true`, and the `OLLAMA_API_URL` environment variable to the URL of your Ollama server (defaults to `http://host.docker.internal:11434`. If you do not set a custom port when starting your Ollama server, you should not need to set this environment variable).

> [!NOTE]
> Open source LLMs are typically not as good at instruction following as proprietary models like GPT-4o or Claude Sonnet. Because of this, you may experience errors or unexpected behavior when using local LLMs.

## Troubleshooting

Below are some common issues you may run into if running Generating UI yourself:

- **I have the LangGraph server running successfully, and my client can make requests, but no text is being generated:** This can happen if you start & connect to multiple different LangGraph servers locally in the same browser. Try clearing the `oc_thread_id_v2` cookie and refreshing the page. This is because each unique LangGraph server has its own database where threads are stored, so a thread ID from one server will not be found in the database of another server.

- **I'm getting 500 network errors when I try to make requests on the client:** Ensure you have the LangGraph server running, and you're making requests to the correct port. You can specify the port to use by passing the `--port <PORT>` flag to the `npx @langchain/langgraph-cli dev` command, and you can set the URL to make requests to by either setting the `LANGGRAPH_API_URL` environment variable, or by changing the fallback value of the `LANGGRAPH_API_URL` variable in `constants.ts`.

- **I'm getting "thread ID not found" error toasts when I try to make requests on the client:** Ensure you have the LangGraph server running, and you're making requests to the correct port. You can specify the port to use by passing the `--port <PORT>` flag to the `npx @langchain/langgraph-cli dev` command, and you can set the URL to make requests to by either setting the `LANGGRAPH_API_URL` environment variable, or by changing the fallback value of the `LANGGRAPH_API_URL` variable in `constants.ts`.

- **`Model name is missing in config.` error is being thrown when I make requests:** This error occurs when the `customModelName` is not specified in the config. You can resolve this by setting the `customModelName` field inside `config.configurable` to the name of the model you want to use when invoking the graph. See [this doc](https://langchain-ai.github.io/langgraphjs/how-tos/configuration/) on how to use configurable fields in LangGraph.

## Roadmap

### Features

Below is a list of features we'd like to add to Generating UI in the near future:

- **Render React in the editor**: Ideally, if you have Generating UI generate React (or HTML) code, we should be able to render it live in the editor. **Edit**: This is in the planning stage now!
- **Multiple assistants**: Users should be able to create multiple assistants, each having their own memory store.
- **Give assistants custom 'tools'**: Once we've implemented `RemoteGraph` in LangGraph.js, users should be able to give assistants access to call their own graphs as tools. This means you could customize your assistant to have access to current events, your own personal knowledge graph, etc.

Do you have a feature request? Please [open an issue](https://github.com/your-username/generating-ui/issues/new)!

### Contributing

We'd like to continue developing and improving Generating UI, and want your help!

To start, there are a handful of GitHub issues with feature requests outlining improvements and additions to make the app's UX even better.
There are three main labels:

- `frontend`: This label is added to issues which are UI focused, and do not require much if any work on the agent(s).
- `ai`: This label is added to issues which are focused on improving the LLM agent(s).
- `fullstack`: This label is added to issues which require touching both the frontend and agent code.

If you have questions about contributing, please reach out to me via email: `your-email(at)domain(dot)com`. For general bugs/issues with the code, please [open an issue on GitHub](https://github.com/your-username/generating-ui/issues/new).