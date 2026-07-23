import { nextTick } from 'vue'
import { flushPromises, shallowMount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NInput, NTabPane, NTabs } from 'naive-ui'
import LoginDialog from '../LoginDialog.vue'

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  setWebdavLogin: vi.fn(),
  mkcol: vi.fn()
}))

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    login: mocks.login,
    register: mocks.register,
    setWebdavLogin: mocks.setWebdavLogin
  })
}))

vi.mock('@/composables/useWebDav', () => ({
  useWebDav: () => ({ mkcol: mocks.mkcol })
}))

const mountDialog = async (initialTab = 'login') => {
  const wrapper = shallowMount(LoginDialog, {
    props: { visible: false, initialTab },
    global: {
      renderStubDefaultSlot: true,
      stubs: {
        ResponsiveOverlay: {
          name: 'ResponsiveOverlay',
          props: ['show', 'title', 'busy', 'desktopWidth'],
          template: '<section><slot /></section>'
        }
      }
    }
  })
  await wrapper.setProps({ visible: true })
  return wrapper
}

const getPane = (wrapper: VueWrapper, name: 'login' | 'register' | 'webdav') => {
  const pane = wrapper.findAllComponents(NTabPane).find(candidate => candidate.props('name') === name)
  if (!pane) throw new Error(`Missing ${name} tab pane`)
  return pane
}

const setTab = async (wrapper: VueWrapper, name: 'login' | 'register' | 'webdav') => {
  wrapper.getComponent(NTabs).vm.$emit('update:value', name)
  await nextTick()
}

const getInput = (wrapper: VueWrapper, idSuffix: string) => {
  const input = wrapper.findAllComponents(NInput).find(candidate => {
    const inputProps = candidate.props('inputProps') as { id?: string } | undefined
    return inputProps?.id?.endsWith(idSuffix)
  })
  if (!input) throw new Error(`Missing input ending with ${idSuffix}`)
  return input
}

const setInputValue = async (wrapper: VueWrapper, idSuffix: string, value: string) => {
  getInput(wrapper, idSuffix).vm.$emit('update:value', value)
  await nextTick()
}

describe('LoginDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.login.mockResolvedValue({ success: true, message: '登录成功' })
    mocks.register.mockResolvedValue({ success: true, message: '注册成功' })
    mocks.mkcol.mockResolvedValue(undefined)
  })

  it('renders each account flow inside its own tab pane and titles WebDAV correctly', async () => {
    const wrapper = await mountDialog()
    const loginPane = getPane(wrapper, 'login')
    const registerPane = getPane(wrapper, 'register')
    const webdavPane = getPane(wrapper, 'webdav')

    expect(loginPane.find('form').exists()).toBe(true)
    expect(loginPane.text()).toContain('登录')
    expect(loginPane.text()).not.toContain('服务器地址(URL)')
    expect(registerPane.find('form').exists()).toBe(true)
    expect(registerPane.text()).toContain('注册并登录')
    expect(webdavPane.find('form').exists()).toBe(true)
    expect(webdavPane.text()).toContain('服务器地址(URL)')

    await setTab(wrapper, 'webdav')
    expect(wrapper.getComponent({ name: 'ResponsiveOverlay' }).props('title')).toBe('连接 WebDAV')
  })

  it('clears stale feedback when switching away from and back to a tab', async () => {
    const wrapper = await mountDialog()

    await getPane(wrapper, 'login').get('form').trigger('submit')
    expect(wrapper.get('.error-message').text()).toBe('用户名和密码不能为空')

    await setTab(wrapper, 'register')
    await setTab(wrapper, 'login')
    expect(wrapper.find('.error-message').exists()).toBe(false)
  })

  it('marks only the missing fields as invalid', async () => {
    const wrapper = await mountDialog()
    await setInputValue(wrapper, '-login-password', 'Password1')

    await getPane(wrapper, 'login').get('form').trigger('submit')

    const usernameProps = getInput(wrapper, '-login-username').props('inputProps') as Record<string, unknown>
    const passwordProps = getInput(wrapper, '-login-password').props('inputProps') as Record<string, unknown>
    expect(usernameProps['aria-invalid']).toBe(true)
    expect(usernameProps['aria-describedby']).toMatch(/-error$/)
    expect(passwordProps['aria-invalid']).toBeUndefined()
    expect(passwordProps['aria-describedby']).toBeUndefined()
  })

  it('does not mark credentials invalid for a server-side failure', async () => {
    mocks.login.mockResolvedValue({ success: false, message: '服务暂不可用' })
    const wrapper = await mountDialog()
    await setInputValue(wrapper, '-login-username', 'student')
    await setInputValue(wrapper, '-login-password', 'Password1')

    await getPane(wrapper, 'login').get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('.error-message').text()).toBe('服务暂不可用')
    const usernameProps = getInput(wrapper, '-login-username').props('inputProps') as Record<string, unknown>
    const passwordProps = getInput(wrapper, '-login-password').props('inputProps') as Record<string, unknown>
    expect(usernameProps['aria-invalid']).toBeUndefined()
    expect(passwordProps['aria-invalid']).toBeUndefined()
  })

  it('clears a registration validation error when its last invalid field is corrected', async () => {
    const wrapper = await mountDialog('register')
    await setInputValue(wrapper, '-register-username', 'student')
    await setInputValue(wrapper, '-register-password', 'weak')

    await getPane(wrapper, 'register').get('form').trigger('submit')
    expect(wrapper.get('.error-message').text()).toContain('密码必须至少')

    await setInputValue(wrapper, '-register-password', 'Password1')
    expect(wrapper.find('.error-message').exists()).toBe(false)
  })

  it('clears WebDAV validation feedback but preserves a remote connection error on edits', async () => {
    const wrapper = await mountDialog('webdav')
    await setInputValue(wrapper, '-webdav-user', 'student')
    await setInputValue(wrapper, '-webdav-password', 'secret')

    await getPane(wrapper, 'webdav').get('form').trigger('submit')
    expect(wrapper.get('.error-message').text()).toBe('请填写完整的 WebDAV 信息')

    await setInputValue(wrapper, '-webdav-url', 'https://dav.example.com')
    expect(wrapper.find('.error-message').exists()).toBe(false)

    mocks.mkcol.mockRejectedValueOnce(new Error('连接超时'))
    await getPane(wrapper, 'webdav').get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('.error-message').text()).toBe('连接超时')

    await setInputValue(wrapper, '-webdav-password', 'updated-secret')
    expect(wrapper.get('.error-message').text()).toBe('连接超时')
  })

  it('announces each password requirement as met or unmet', async () => {
    const wrapper = await mountDialog('register')
    await setInputValue(wrapper, '-register-password', 'abc')

    const requirements = getPane(wrapper, 'register').get('.password-requirements')
    expect(requirements.attributes('aria-live')).toBe('polite')
    expect(requirements.findAll('.sr-only').map(item => item.text())).toEqual([
      '，未满足',
      '，未满足',
      '，已满足',
      '，未满足'
    ])

    const passwordProps = getInput(wrapper, '-register-password').props('inputProps') as Record<string, unknown>
    expect(passwordProps['aria-describedby']).toBe(requirements.attributes('id'))
  })
})
