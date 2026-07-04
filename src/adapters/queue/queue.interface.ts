export interface Queue<TData = unknown> {
  enqueue(jobName: string, data: TData): Promise<void>;
}
