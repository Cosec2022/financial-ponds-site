export class CollectorContract {
  constructor({ id, description }) {
    this.id = id;
    this.description = description;
  }

  async collect() {
    throw new Error("Collector must implement collect({ asOf, registry, config })");
  }
}
