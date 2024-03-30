if (!('alert' in window)) {
  const alertElm = document.getElementById('alert') as any
  const alertContentElm = document.getElementById('alert-content')!
  const alertInputElm = document.getElementById('alert-input') as HTMLInputElement
  const cancelBtn = alertElm.querySelector('.cancel')!
  const titleElm = alertElm.querySelector('.title')!

  alertElm.querySelector('.ok')!.onclick = () => alertElm.close('OK')
  cancelBtn.onclick = () => alertElm.close('CANCEL')

  ;(window as any).alert = async (message: string) => {
    alertContentElm.innerText = message
    alertInputElm.style.display = 'none'
    cancelBtn.style.display = 'none'
    titleElm.innerText = 'Omokage - 提示'
    await alertElm.uxpShowModal({
      title: 'Omokage',
      resize: 'none'
    })
  }

  ;(window as any).prompt = async (message: string, placeholder: string) => {
    alertContentElm.innerText = message
    alertInputElm.value = ''
    alertInputElm.placeholder = placeholder
    alertInputElm.style.display = 'block'
    cancelBtn.style.display = 'block'
    titleElm.innerText = 'Omokage - 输入'
    return await alertElm.uxpShowModal({
      title: 'Omokage',
      resize: 'none'
    }) === 'OK'
      ? alertInputElm.value
      : null
  }

  ;(window as any).confirm = async (message: string) => {
    alertContentElm.innerText = message
    alertInputElm.style.display = 'none'
    cancelBtn.style.display = 'block'
    titleElm.innerText = 'Omokage - 确认'
    return await alertElm.uxpShowModal({
      title: 'Omokage',
      resize: 'none'
    }) === 'OK'
  }
}

export const alert = window.alert as (message: string) => Promise<void>
export const prompt = window.prompt as any as (message: string, placeholder: string) => Promise<string | null>
export const confirm = window.confirm as any as (message: string) => Promise<boolean>
