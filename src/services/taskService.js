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
}

module.exports = TaskService;
