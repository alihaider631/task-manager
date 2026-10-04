const { randomUUID } = require("node:crypto");
const { createServer } = require("node:http");
const { mkdir, readFile, rename, unlink, writeFile } = require("node:fs/promises");
const path = require("node:path");

const projectDirectory = __dirname;
const dataDirectory = path.join(projectDirectory, "data");
const tasksFile = path.join(dataDirectory, "tasks.json");
const priorities = new Set(["Low", "Medium", "High"]);
const maximumRequestSize = 16 * 1024;

let tasks = [];
let persistenceQueue = Promise.resolve();

async function loadTasks() {
	try {
		const savedTasks = JSON.parse(await readFile(tasksFile, "utf8"));
		if (!Array.isArray(savedTasks)) {
			throw new Error("The task data file must contain a JSON array.");
		}
		tasks = savedTasks;
	} catch (error) {
		if (error.code === "ENOENT") {
			return;
		}
		throw error;
	}
}

function persistTasks() {
	const snapshot = JSON.stringify(tasks, null, 2);
	const writeOperation = persistenceQueue.then(async () => {
		await mkdir(dataDirectory, { recursive: true });
		const temporaryFile = `${tasksFile}.${randomUUID()}.tmp`;
		try {
			await writeFile(temporaryFile, snapshot, "utf8");
			await rename(temporaryFile, tasksFile);
		} catch (error) {
			await unlink(temporaryFile).catch(() => {});
			throw error;
		}
	});
	persistenceQueue = writeOperation.catch(() => {});
	return writeOperation;
}

function sendJson(response, statusCode, value) {
	response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
	response.end(JSON.stringify(value));
}

function readJsonBody(request) {
	return new Promise((resolve, reject) => {
		let body = "";
		let tooLarge = false;
		request.on("data", (chunk) => {
			if (tooLarge) {
				return;
			}
			body += chunk;
			if (Buffer.byteLength(body) > maximumRequestSize) {
				tooLarge = true;
				body = "";
			}
		});
		request.on("end", () => {
			if (tooLarge) {
				reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
				return;
			}
			try {
				resolve(JSON.parse(body));
			} catch {
				reject(Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 }));
			}
		});
		request.on("error", reject);
	});
}

function isValidDate(value) {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateNewTask(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return "Task data must be a JSON object.";
	}
	if (typeof value.title !== "string" || !value.title.trim() || value.title.trim().length > 120) {
		return "Title is required and must be 120 characters or fewer.";
	}
	if (value.details !== undefined && (typeof value.details !== "string" || value.details.length > 500)) {
		return "Details must be 500 characters or fewer.";
	}
	if (value.dueDate !== undefined && value.dueDate !== "" && !isValidDate(value.dueDate)) {
		return "Due date must be a valid date in YYYY-MM-DD format.";
	}
	if (value.priority !== undefined && !priorities.has(value.priority)) {
		return "Priority must be Low, Medium, or High.";
	}
	return null;
}

async function handleApiRequest(request, response, url) {
	const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);

	if (url.pathname === "/api/tasks" && request.method === "GET") {
		sendJson(response, 200, tasks);
		return;
	}

	if (url.pathname === "/api/tasks" && request.method === "POST") {
		const body = await readJsonBody(request);
		const validationError = validateNewTask(body);
		if (validationError) {
			sendJson(response, 400, { error: validationError });
			return;
		}

		const task = {
			id: randomUUID(),
			title: body.title.trim(),
			details: (body.details || "").trim(),
			dueDate: body.dueDate || "",
			priority: body.priority || "Medium",
			completed: false
		};
		tasks.unshift(task);
		await persistTasks();
		sendJson(response, 201, task);
		return;
	}

	if (taskMatch && request.method === "PATCH") {
		let taskId;
		try {
			taskId = decodeURIComponent(taskMatch[1]);
		} catch {
			sendJson(response, 400, { error: "Task ID is invalid." });
			return;
		}
		const task = tasks.find((savedTask) => savedTask.id === taskId);
		if (!task) {
			sendJson(response, 404, { error: "Task not found." });
			return;
		}
		const body = await readJsonBody(request);
		if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.completed !== "boolean") {
			sendJson(response, 400, { error: "A boolean completed value is required." });
			return;
		}

		task.completed = body.completed;
		await persistTasks();
		sendJson(response, 200, task);
		return;
	}

	if (taskMatch && request.method === "DELETE") {
		let taskId;
		try {
			taskId = decodeURIComponent(taskMatch[1]);
		} catch {
			sendJson(response, 400, { error: "Task ID is invalid." });
			return;
		}
		const taskIndex = tasks.findIndex((savedTask) => savedTask.id === taskId);
		if (taskIndex === -1) {
			sendJson(response, 404, { error: "Task not found." });
			return;
		}

		tasks.splice(taskIndex, 1);
		await persistTasks();
		response.writeHead(204);
		response.end();
		return;
	}

	sendJson(response, 404, { error: "API route not found." });
}

function servePage(request, response, url) {
	if (request.method !== "GET" && request.method !== "HEAD") {
		sendJson(response, 405, { error: "Method not allowed." });
		return;
	}

	const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
	const allowedFiles = new Set(["/index.html", "/script.js", "/style.css"]);
	if (!allowedFiles.has(requestedPath)) {
		sendJson(response, 404, { error: "File not found." });
		return;
	}

	const filePath = path.join(projectDirectory, requestedPath.slice(1));
	const contentTypes = {
		".html": "text/html; charset=utf-8",
		".js": "text/javascript; charset=utf-8",
		".css": "text/css; charset=utf-8"
	};
	readFile(filePath)
		.then((content) => {
			response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] });
			response.end(request.method === "HEAD" ? undefined : content);
		})
		.catch((error) => {
			if (error.code === "ENOENT") {
				sendJson(response, 404, { error: "File not found." });
			} else {
				console.error("Failed to serve a project file:", error);
				sendJson(response, 500, { error: "Unable to serve the requested file." });
			}
		});
}

const server = createServer(async (request, response) => {
	try {
		const url = new URL(request.url, "http://localhost");
		if (url.pathname.startsWith("/api/")) {
			await handleApiRequest(request, response, url);
		} else {
			servePage(request, response, url);
		}
	} catch (error) {
		console.error("Request failed:", error);
		if (!response.headersSent) {
			sendJson(response, error.statusCode || 500, {
				error: error.statusCode ? error.message : "An unexpected server error occurred."
			});
		} else {
			response.destroy(error);
		}
	}
});

const port = Number(process.env.PORT) || 3000;
loadTasks()
	.then(() => {
		server.listen(port, "127.0.0.1", () => {
			console.log(`Task Manager is running at http://127.0.0.1:${port}`);
		});
	})
	.catch((error) => {
		console.error("Failed to load saved tasks:", error);
		process.exitCode = 1;
	});
