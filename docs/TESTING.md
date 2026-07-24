# 测试指南

## 快速开始

```bash
npm run test
npm run test:run
npm run test:coverage
npm run test:ui
npm run test:watch
```

自动排位性能基准默认跳过，需要显式运行：

```bash
npm run test:assignment:benchmark
```

## 测试结构

```
src/
├── composables/
│   ├── __tests__/
│   │   ├── useStudentData.test.ts
│   │   ├── useSeatChart.test.ts
│   │   ├── useAssignment.test.ts
│   │   ├── useTagData.test.ts
│   │   ├── useZoneData.test.ts
│   │   ├── useUndo.test.ts
│   │   ├── useSeatRules.test.ts
│   │   ├── useEditMode.test.ts
│   │   ├── integration.test.ts
│   │   └── edge-cases.test.ts
│   └── ...
└── test-utils/
    ├── setup.ts
    ├── mocks.ts
    ├── factories.ts
    └── assertions.ts
```

## 测试工具

### Mocks

使用 `src/test-utils/mocks.ts` 创建 mock 对象：

```javascript
import { createMockSeatChart, createMockStudentData } from '@/test-utils/mocks'

const seatChart = createMockSeatChart()
const studentData = createMockStudentData()
```

### Factories

使用 `src/test-utils/factories.ts` 创建测试数据：

```javascript
import { createMockStudent, createMockSeats } from '@/test-utils/factories'

const student = createMockStudent({ name: '张三', studentNumber: 1 })
const seats = createMockSeats(4, 2, 7)
```

### Assertions

使用 `src/test-utils/assertions.ts` 进行断言：

```javascript
import { expectSeatToHaveStudent, expectStudentToHaveTags } from '@/test-utils/assertions'

expectSeatToHaveStudent(seat, studentId)
expectStudentToHaveTags(student, [1, 2, 3])
```

## 测试类型

### 单元测试

测试单个 composable 的功能：

```javascript
describe('useStudentData', () => {
  it('should add a new student', () => {
    const { addStudent, students } = useStudentData()
    const id = addStudent()
    expect(students.value).toHaveLength(1)
  })
})
```

### 集成测试

测试多个 composable 的交互：

```javascript
describe('Integration: Student and Seat Management', () => {
  it('should handle full student lifecycle', () => {
    const studentData = useStudentData()
    const seatChart = useSeatChart()
    // 测试完整流程
  })
})
```

### 边界测试

测试极端情况和边界条件：

```javascript
describe('Edge Cases', () => {
  it('should handle extremely long names', () => {
    const longName = 'A'.repeat(1000)
    // 测试边界情况
  })
})
```

## 覆盖率目标

当前覆盖率门禁统计核心业务层 `src/composables/*.ts`、`src/utils/*.ts` 与 `src/platform/*.ts`，Vue 组件和视图仍会运行测试，但暂不计入这一阶段的覆盖率聚合。

- 核心业务层总计：Lines 70%、Functions 75%、Branches 65%、Statements 70%。
- `src/composables/*.ts`：Lines 70%、Functions 75%、Branches 65%、Statements 70%。
- `src/utils/*.ts`：Lines 75%、Functions 80%、Branches 65%、Statements 75%。
- `src/platform/*.ts`：Lines 65%、Functions 70%、Branches 70%、Statements 65%。

这些阈值按总计和目录层级聚合，不是逐文件门禁；修改低覆盖的关键文件时仍应补充对应回归测试。

## CI/CD

测试在以下情况自动运行：

- Push 到 main 或 dev 分支
- 创建 Pull Request

CI 使用 Node.js 20，并通过仓库的可复用验证 workflow 运行检查与测试。

## 最佳实践

1. 每个测试应该独立且可重复
2. 使用 `beforeEach` 清理状态
3. 使用描述性的测试名称
4. 测试边界条件和错误情况
5. 保持测试简单和专注
6. 使用工厂函数创建测试数据
7. 使用自定义断言提高可读性

## 调试测试

使用 Vitest UI 进行可视化调试：

```bash
npm run test:ui
```

在浏览器中打开 `http://localhost:51204/__vitest__/`

## 常见问题

### 测试超时

增加 `testTimeout` 或 `hookTimeout` 配置。

### Mock 不生效

确保在测试文件顶部使用 `vi.mock()`。

### 状态污染

在 `beforeEach` 中清理所有状态。
