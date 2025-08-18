import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface AssistantMessage {
  'content' : [] | [string],
  'tool_calls' : Array<ToolCall>,
}
export type ChatMessage = {
    'tool' : { 'content' : string, 'tool_call_id' : string }
  } |
  { 'user' : { 'content' : string } } |
  { 'assistant' : AssistantMessage } |
  { 'system' : { 'content' : string } };
export interface FunctionCall {
  'name' : string,
  'arguments' : Array<ToolCallArgument>,
}
export type Result = { 'Ok' : null } |
  { 'Err' : string };
export interface SavedAccount {
  'alias' : string,
  'owner' : Principal,
  'subaccount' : [] | [Uint8Array | number[]],
}
export interface ToolCall { 'id' : string, 'function' : FunctionCall }
export interface ToolCallArgument { 'value' : string, 'name' : string }
export interface _SERVICE {
  'copilot_chat' : ActorMethod<[Array<ChatMessage>], string>,
  'list_accounts' : ActorMethod<[], Array<SavedAccount>>,
  'save_account' : ActorMethod<
    [string, string, [] | [Uint8Array | number[]]],
    Result
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
