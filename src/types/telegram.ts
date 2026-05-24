// src/types/telegram.ts

export interface TelegramWebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
  is_premium?: boolean
  allows_write_to_pm?: boolean
}

export interface ParsedInitData {
  user?: TelegramWebAppUser
  chat_instance?: string
  chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel'
  auth_date: number
  hash: string
  start_param?: string
  query_id?: string
}