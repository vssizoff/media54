import * as mm from "music-metadata";

export type UploadedFile = {
    file: string,
    path: string,
    filename: string
} & ({
    type: "image" | "other",
    meta: undefined,
    max: undefined
} | {
    type: "presentation",
    meta: undefined,
    max: number
} | {
    type: "audio" | "video",
    meta: mm.ICommonTagsResult,
    max: undefined
})

export type CollectionFile = {
    title: string,
    type: "image" | "other" | "label" | "audio" | "video" | "presentation",
    file: string,
    id: number,
    max?: number,
    volume?: number
};

export type MediaFile = CollectionFile & {
    playing: boolean,
    editing: boolean
};