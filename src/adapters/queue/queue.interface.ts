export interface Queue<TName extends string, TData> {
  enqueue(jobName: TName, data: TData): Promise<void>;
}
