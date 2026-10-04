import { MemoryProductivityRepository } from './memory.ts';
import { runRepositoryContract } from './repository-contract.ts';

runRepositoryContract('MemoryProductivityRepository', () => new MemoryProductivityRepository());
