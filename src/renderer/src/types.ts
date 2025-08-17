import * as mm from "music-metadata";

export type UploadedFile = {
    file: string,
    path: string,
    filename: string
} & ({
    type: "image" | "other" | "label",
    meta: undefined
} | {
    type: "audio" | "video",
    meta: mm.ICommonTagsResult
})

export type MediaFile = (UploadedFile & {
    playing: boolean,
    title: string,
    editing: boolean
})