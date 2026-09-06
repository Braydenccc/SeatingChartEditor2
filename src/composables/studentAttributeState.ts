import { ref } from 'vue'
import type { NumericAttributeDefinition } from '@/types'

const defaultAttributeDefinitions: NumericAttributeDefinition[] = [
  {
    id: 'height',
    name: '身高',
    unit: 'cm',
    min: 80,
    max: 220,
    precision: 0,
    enabled: true,
    showInEditor: true,
    builtInKey: 'height',
    createdFrom: 'default'
  },
  {
    id: 'score',
    name: '成绩',
    unit: '分',
    min: 0,
    max: 150,
    precision: 1,
    enabled: true,
    showInEditor: true,
    builtInKey: 'score',
    createdFrom: 'default'
  }
]

export const createDefaultAttributeDefinitions = (): NumericAttributeDefinition[] =>
  defaultAttributeDefinitions.map(definition => ({ ...definition }))

export const attributeDefinitions = ref<NumericAttributeDefinition[]>(
  createDefaultAttributeDefinitions()
)
