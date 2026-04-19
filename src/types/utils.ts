// 工具类型定义

// 深度部分类型
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// 只读深度类型
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

// 提取函数参数类型
export type ExtractFunctionParams<T> = T extends (...args: infer P) => unknown ? P : never

// 提取函数返回类型
export type ExtractFunctionReturn<T> = T extends (...args: unknown[]) => infer R ? R : never

// 可空类型
export type Nullable<T> = T | null

// 可选类型
export type Optional<T> = T | undefined

// 数组元素类型
export type ArrayElement<T> = T extends (infer E)[] ? E : never
