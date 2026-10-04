# Student Task Manager

## Run the app

Install Node.js, open a terminal in this folder, and run:

```sh
node backend.js
```

Then open <http://127.0.0.1:3000>. Tasks are saved in `data/tasks.json`, created automatically when the first task is added. Set the `PORT` environment variable to use a different port.

The server uses only Node.js built-in modules. Its API supports listing tasks (`GET /api/tasks`), adding tasks (`POST /api/tasks`), marking a task active or complete (`PATCH /api/tasks/:id`), and deleting tasks (`DELETE /api/tasks/:id`).