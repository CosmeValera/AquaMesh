import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createSocialRepository } from '../../../src/social'

describe('social repository', () => {
  it('routes sensitive social writes through RPCs', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    const repository = createSocialRepository({ rpc } as never)

    await repository.sendFriendRequest('friend-1')
    await repository.sendMessage('friend-1', 'Study together?')
    await repository.shareGuide('friend-1', 'guide-1')
    await repository.blockUser('friend-1')

    expect(rpc).toHaveBeenNthCalledWith(1, 'social_send_friend_request', {
      p_addressee_id: 'friend-1',
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'social_send_message', {
      p_recipient_id: 'friend-1',
      p_body: 'Study together?',
    })
    expect(rpc).toHaveBeenNthCalledWith(3, 'social_share_study_guide', {
      p_recipient_id: 'friend-1',
      p_source_guide_id: 'guide-1',
    })
    expect(rpc).toHaveBeenNthCalledWith(4, 'social_block_user', {
      p_user_id: 'friend-1',
    })
  })

  it('keeps social schema private and supports independent Guide copies', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'docs/supabase-auth-sync.sql'),
      'utf8',
    ).replace(/\s+/g, ' ')

    expect(sql).toContain('create table if not exists public.social_profiles')
    expect(sql).toContain('create table if not exists public.social_friendships')
    expect(sql).toContain('create table if not exists public.social_direct_messages')
    expect(sql).toContain('create table if not exists public.social_guide_shares')
    expect(sql).toContain('create or replace function public.social_share_study_guide')
    expect(sql).toContain('create or replace function public.social_respond_guide_share')
    expect(sql).toContain('shared_from_user_id uuid references public.profiles(id) on delete set null')
    expect(sql).toContain('create policy "social_profiles_select_related"')
    expect(sql).toContain("values ('social-avatars', 'social-avatars', true)")
  })
})
