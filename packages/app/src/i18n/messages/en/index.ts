import { credits } from './credits'
import { lessons } from './lessons'
import { planets } from './planets'
import { scene } from './scene'
import { ui } from './ui'
import { voyagerScene } from './voyager'
import { missions } from './missions'
import { controls } from './controls'

// The English catalog is the reference: every other language's catalog has its shape (Messages),
// so a text one of them misses fails the type check.
export const en = { ui, scene, planets, lessons, credits, voyager: voyagerScene, missions, controls }

export type Messages = typeof en
