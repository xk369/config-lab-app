class TaskService {
  constructor(taskRepository) {
    this.taskRepository = taskRepository;
  }

  async listTasks() {
    const tasks = await this.taskRepository.findAll();
    return tasks.map((task) => ({
      ...task,
      isCompleted: task.status === 'done',
    }));
  }

  async getSummary() {
    const tasks = await this.listTasks();
    const completedCount = tasks.filter((task) => task.isCompleted).length;

    return {
      total: tasks.length,
      completed: completedCount,
      remaining: tasks.length - completedCount,
    };
  }

  async createTask(task) {
    const title = typeof task.title === 'string' ? task.title.trim() : '';
    const status = task.status === 'done' ? 'done' : 'planned';

    if (!title) {
      throw new Error('Task title is required.');
    }

    const createdTask = await this.taskRepository.create({ title, status });

    return {
      ...createdTask,
      isCompleted: createdTask.status === 'done',
    };
  }
}

module.exports = TaskService;
