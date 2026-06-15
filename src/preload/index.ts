import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import remote from "@electron/remote";

const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}

// @ts-ignore
window.electronRemote = {
  require: remote.require
}