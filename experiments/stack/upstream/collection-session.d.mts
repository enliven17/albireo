export type Session = {sessionId:string;visitId:string;iat:number;sessionDrift:boolean};
export declare function resolveCollectionSession(input:{sourceId:string;ip:string;userAgent:string;createdAt:Date;historical?:boolean;cache?:Session & {websiteId:string}}):Session;
