const form = document.querySelector("#task-form");
const taskList = document.querySelector("#task-list");
const searchInput = document.querySelector("#task-search");
const filterSelect = document.querySelector("#task-filter");
const taskCount = document.querySelector("#task-count");
const emptyMessage = document.querySelector("#empty-message");
const noResultsMessage = document.querySelector("#no-results-message");
const errorMessage = document.querySelector("#task-error");

let tasks = [];

async function request(path, options = {}) {
	const response = await fetch(path, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...options.headers
		}
	});
	const result = response.status === 204 ? null : await response.json();
	if (!response.ok) {
		throw new Error(result.error || "The request could not be completed.");
	}
	return result;
}

function showError(error) {
	errorMessage.textContent = error.message || "Something went wrong. Please try again.";
	errorMessage.hidden = false;
}

function clearError() {
	errorMessage.textContent = "";
	errorMessage.hidden = true;
}

function renderTasks() {
	const query = searchInput.value.trim().toLowerCase();
	const status = filterSelect.value;
	const visibleTasks = tasks.filter((task) => {
		const matchesSearch = `${task.title} ${task.details}`.toLowerCase().includes(query);
		const matchesStatus = status === "all"
			|| (status === "active" && !task.completed)
			|| (status === "completed" && task.completed);
		return matchesSearch && matchesStatus;
	});

	taskList.replaceChildren();
	visibleTasks.forEach((task) => {
		const item = document.createElement("li");
		const heading = document.createElement("h3");
		heading.textContent = task.title;
		if (task.completed) {
			heading.append(" (Completed)");
		}
		item.append(heading);

		if (task.details) {
			const details = document.createElement("p");
			details.textContent = task.details;
			item.append(details);
		}

		const metadata = document.createElement("p");
		metadata.textContent = `Priority: ${task.priority}${task.dueDate ? ` | Due: ${task.dueDate}` : ""}`;
		item.append(metadata);

		const completeButton = document.createElement("button");
		completeButton.type = "button";
		completeButton.textContent = task.completed ? "Mark active" : "Mark done";
		completeButton.setAttribute("aria-label", `${task.completed ? "Mark active" : "Mark done"}: ${task.title}`);
		completeButton.addEventListener("click", async () => {
			clearError();
			try {
				const updatedTask = await request(`/api/tasks/${encodeURIComponent(task.id)}`, {
					method: "PATCH",
					body: JSON.stringify({ completed: !task.completed })
				});
				tasks = tasks.map((savedTask) => savedTask.id === updatedTask.id ? updatedTask : savedTask);
				renderTasks();
			} catch (error) {
				showError(error);
			}
		});
		item.append(completeButton, " ");

		const deleteButton = document.createElement("button");
		deleteButton.type = "button";
		deleteButton.textContent = "Delete";
		deleteButton.setAttribute("aria-label", `Delete: ${task.title}`);
		deleteButton.addEventListener("click", async () => {
			clearError();
			try {
				await request(`/api/tasks/${encodeURIComponent(task.id)}`, { method: "DELETE" });
				tasks = tasks.filter((savedTask) => savedTask.id !== task.id);
				renderTasks();
			} catch (error) {
				showError(error);
			}
		});
		item.append(deleteButton);
		taskList.append(item);
	});

	const activeCount = tasks.filter((task) => !task.completed).length;
	taskCount.textContent = `${tasks.length} task${tasks.length === 1 ? "" : "s"} total, ${activeCount} active`;
	emptyMessage.hidden = tasks.length > 0;
	noResultsMessage.hidden = tasks.length === 0 || visibleTasks.length > 0;
}

form.addEventListener("submit", async (event) => {
	event.preventDefault();
	clearError();

	const formData = new FormData(form);
	const title = String(formData.get("title")).trim();
	if (!title) {
		document.querySelector("#task-title").focus();
		return;
	}

	try {
		const task = await request("/api/tasks", {
			method: "POST",
			body: JSON.stringify({
				title,
				details: String(formData.get("details")).trim(),
				dueDate: String(formData.get("dueDate")),
				priority: String(formData.get("priority"))
			})
		});
		tasks.unshift(task);
		form.reset();
		renderTasks();
		document.querySelector("#task-title").focus();
	} catch (error) {
		showError(error);
	}
});

searchInput.addEventListener("input", renderTasks);
filterSelect.addEventListener("change", renderTasks);

request("/api/tasks")
	.then((savedTasks) => {
		tasks = savedTasks;
		renderTasks();
	})
	.catch(showError);