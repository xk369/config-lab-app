const fs = require('node:fs/promises');
const path = require('node:path');

const initialTasks = [
  {
    id: 1,
    title: 'Вынести настройки в переменные окружения',
    status: 'done',
  },
  {
    id: 2,
    title: 'Разделить приложение на маршруты, сервисы и слой данных',
    status: 'done',
  },
  {
    id: 3,
    title: 'Подготовить Dockerfile для повторяемого запуска',
    status: 'planned',
  },
];

class TaskRepository {
  constructor(dataFile) {
    this.dataFile = dataFile;
  }

  async ensureStorage() {
    await fs.mkdir(path.dirname(this.dataFile), { recursive: true });

    try {
      await fs.access(this.dataFile);
    } catch (error) {
      await this.saveAll(initialTasks);
    }
  }

  async findAll() {
    await this.ensureStorage();
    const content = await fs.readFile(this.dataFile, 'utf8');
    return JSON.parse(content);
  }

  async saveAll(tasks) {
    await fs.mkdir(path.dirname(this.dataFile), { recursive: true });
    await fs.writeFile(this.dataFile, `${JSON.stringify(tasks, null, 2)}\n`);
  }
}

module.exports = TaskRepository;
