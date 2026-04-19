# 测试指南

## 快速开始

```bash
npm run test
npm run test:run
npm run test:coverage
npm run test:ui
npm run test:watch
```

## 测试结构

```
src/
├── composables/
│   ├── __tests__/
│   │   ├── useStudentData.test.js
│   │   ├── useSeatChart.test.js
│   │   ├── useAssignment.test.js
│   │   ├── useTagData.test.js
│   │   ├── useZoneData.test.js
│   │   ├── useUndo.test.js
│   │   ├── useSeatRules.test.js
│   │   ├── useEditMode.test.js
│   │   ├── integration.test.js
│   │   └── edge-cases.test.js
│   └── ...
└── test-utils/
    ├── setup.js
    ├── mocks.js
    ├── factories.js
    └── assertions.js
```

## 测试工具

### Mocks

使用 `src/test-utils/mocks.js` 创建 mock 对象：

```javascript
import { createMockSeatChart, createMockStudentData } from '@/test-utils/mocks'

const seatChart = createMockSeatChart()
const studentData = createMockStudentData()
```

### Factories

使用 `src/test-utils/factories.js` 创建测试数据：

```javascript
import { createMockStudent, createMockSeats } from '@/test-utils/factories'

const student = createMockStudent({ name: '张三', studentNumber: 1 })
const seats = createMockSeats(4, 2, 7)
```

### Assertions

使用 `src/test-utils/assertions.js` 进行断言：

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

- Lines: 70%
- Functions: 70%
- Branches: 60%
- Statements: 70%

## CI/CD

测试在以下情况自动运行：

- Push 到 main 或 dev 分支
- 创建 Pull Request

测试矩阵：

- Node.js 20.x
- Node.js 22.x

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
