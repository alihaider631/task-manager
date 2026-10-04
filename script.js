const form = document.querySelector("#task-form");
const taskList = document.querySelector("#task-list");
const searchInput = document.querySelector("#task-search");
const filterSelect = document.querySelector("#task-filter");
const taskCount = document.querySelector("#task-count");
const emptyMessage = document.querySelector("#empty-message");
const noResultsMessage = document.querySelector("#no-results-message");
const errorMessage = document.querySelector("#task-error");

const storageKey = "student-task-manager-tasks";
let tasks = [];

function loadTasks() {
	try {
		const savedTasks = localStorage.getItem(storageKey);
		if (savedTasks === null) {
			tasks = [];
			return;
		}

		const parsedTasks = JSON.parse(savedTasks);
		if (!Array.isArray(parsedTasks)) {
			throw new Error("Saved task data must be a list.");
		}
		tasks = parsedTasks;
	} catch (error) {
		showError(`Tasks could not be loaded: ${error.message}`);
	}
}

function saveTasks(updatedTasks) {
	try {
		localStorage.setItem(storageKey, JSON.stringify(updatedTasks));
		tasks = updatedTasks;
		return true;
	} catch (error) {
		showError(`Tasks could not be saved: ${error.message}`);
		return false;
	}
}

function showError(message) {
	errorMessage.textContent =
		message || "Something went wrong. Please try again.";

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
		const title = String(task.title || "").toLowerCase();
		const details = String(task.details || "").toLowerCase();

		const matchesSearch =
			title.includes(query) || details.includes(query);

		const matchesStatus =
			status === "all" ||
			(status === "active" && !task.completed) ||
			(status === "completed" && task.completed);

		return matchesSearch && matchesStatus;
	});

	taskList.replaceChildren();

	visibleTasks.forEach((task) => {
		const item = document.createElement("li");
		item.className = "task-item";

		if (task.completed) {
			item.classList.add("completed");
		}

		const content = document.createElement("div");
		content.className = "task-content";

		const heading = document.createElement("h3");
		heading.textContent = task.title;

		if (task.completed) {
			heading.append(" (Completed)");
		}

		content.append(heading);

		if (task.details) {
			const details = document.createElement("p");
			details.textContent = task.details;
			content.append(details);
		}

		const metadata = document.createElement("p");
		metadata.className = "task-metadata";

		let metadataText = `Priority: ${task.priority}`;

		if (task.dueDate) {
			metadataText += ` | Due: ${task.dueDate}`;
		}

		metadata.textContent = metadataText;
		content.append(metadata);

		const actions = document.createElement("div");
		actions.className = "task-actions";

		const completeButton = document.createElement("button");
		completeButton.type = "button";
		completeButton.textContent = task.completed
			? "Mark Active"
			: "Mark Done";

		completeButton.setAttribute(
			"aria-label",
			`${task.completed ? "Mark active" : "Mark done"}: ${task.title}`
		);

		completeButton.addEventListener("click", () => {
			toggleTask(task.id);
		});

		const deleteButton = document.createElement("button");
		deleteButton.type = "button";
		deleteButton.textContent = "Delete";

		deleteButton.setAttribute(
			"aria-label",
			`Delete: ${task.title}`
		);

		deleteButton.addEventListener("click", () => {
			deleteTask(task.id);
		});

		actions.append(completeButton, deleteButton);

		item.append(content, actions);
		taskList.append(item);
	});

	updateTaskMessages(visibleTasks);
}

function updateTaskMessages(visibleTasks) {
	const activeCount = tasks.filter((task) => !task.completed).length;

	taskCount.textContent =
		`${tasks.length} task${tasks.length === 1 ? "" : "s"} total, ` +
		`${activeCount} active`;

	emptyMessage.hidden = tasks.length > 0;

	noResultsMessage.hidden =
		tasks.length === 0 || visibleTasks.length > 0;
}

function addTask(event) {
	event.preventDefault();
	clearError();

	const formData = new FormData(form);

	const title = String(formData.get("title") || "").trim();
	const details = String(formData.get("details") || "").trim();
	const dueDate = String(formData.get("dueDate") || "");
	const priority = String(formData.get("priority") || "Medium");

	if (!title) {
		showError("Please enter a task title.");
		document.querySelector("#task-title").focus();
		return;
	}

	if (title.length > 120) {
		showError("Task title cannot be longer than 120 characters.");
		return;
	}

	if (details.length > 500) {
		showError("Task details cannot be longer than 500 characters.");
		return;
	}

	if (!["Low", "Medium", "High"].includes(priority)) {
		showError("Please select a valid priority.");
		return;
	}

	const task = {
		id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
		title,
		details,
		dueDate,
		priority,
		completed: false
	};

	if (saveTasks([task, ...tasks])) {
		renderTasks();
		form.reset();
		document.querySelector("#task-title").focus();
	}
}

function toggleTask(taskId) {
	clearError();

	const task = tasks.find(
		(savedTask) => savedTask.id === taskId
	);

	if (!task) {
		showError("The selected task could not be found.");
		return;
	}

	const updatedTasks = tasks.map((savedTask) =>
		savedTask.id === taskId
			? { ...savedTask, completed: !savedTask.completed }
			: savedTask
	);
	if (saveTasks(updatedTasks)) {
		renderTasks();
	}
}

function deleteTask(taskId) {
	clearError();

	const task = tasks.find(
		(savedTask) => savedTask.id === taskId
	);

	if (!task) {
		showError("The selected task could not be found.");
		return;
	}

	const confirmed = window.confirm(
		`Are you sure you want to delete "${task.title}"?`
	);

	if (!confirmed) {
		return;
	}

	const updatedTasks = tasks.filter((savedTask) => savedTask.id !== taskId);
	if (saveTasks(updatedTasks)) {
		renderTasks();
	}
}

function searchTasks() {
	renderTasks();
}

function filterTasks() {
	renderTasks();
}

form.addEventListener("submit", addTask);

searchInput.addEventListener("input", searchTasks);

filterSelect.addEventListener("change", filterTasks);

loadTasks();
renderTasks();