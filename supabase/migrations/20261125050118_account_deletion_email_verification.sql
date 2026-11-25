-- Server-only, account-bound email challenges for permanent account deletion.
-- The application must generate a random code and a keyed HMAC; never pass plaintext codes here.
-- This migration alone does not enable account deletion or send emails.
create table public.account_deletion_challenges (
    user_id uuid primary key references auth.users(id) on delete cascade,
    challenge_id uuid,
    session_id uuid,
    email text,
    code_digest text check (code_digest is null or code_digest ~ '^[0-9a-f]{64}$'),
    expires_at timestamptz,
    attempts integer not null default 0 check (attempts between 0 and 5),
    request_times timestamptz[] not null default '{}',
    constraint account_deletion_challenge_state check (
        (code_digest is null and challenge_id is null and session_id is null
            and email is null and expires_at is null)
        or (code_digest is not null and challenge_id is not null and session_id is not null
            and email is not null and expires_at is not null and attempts < 5)
    )
);

alter table public.account_deletion_challenges enable row level security;
revoke all on table public.account_deletion_challenges from public, anon, authenticated, service_role;
grant select, insert, update on table public.account_deletion_challenges to service_role;

-- The row lock serializes issuance and verification across application instances.
-- Failed delivery still counts toward the rate limit; no reset is exposed to clients.
create function public.issue_account_deletion_challenge(
    p_user_id uuid, p_challenge_id uuid, p_session_id uuid, p_email text, p_code_digest text
) returns text
language plpgsql security invoker set search_path = ''
as $$
declare
    v_row public.account_deletion_challenges%rowtype;
    v_now timestamptz;
    v_recent timestamptz[];
begin
    if p_user_id is null or p_challenge_id is null or p_session_id is null
        or p_email is null or length(p_email) not between 1 and 254
        or p_code_digest is null or p_code_digest !~ '^[0-9a-f]{64}$' then
        return 'invalid';
    end if;

    insert into public.account_deletion_challenges (user_id) values (p_user_id)
    on conflict (user_id) do nothing;

    select * into strict v_row from public.account_deletion_challenges
    where user_id = p_user_id for update;
    v_now := clock_timestamp();
    v_recent := array(select t from unnest(v_row.request_times) as r(t)
        where t > v_now - interval '1 hour' order by t);

    if cardinality(v_recent) >= 5 then
        return 'rate_limited';
    end if;
    if cardinality(v_recent) > 0 and
        v_recent[cardinality(v_recent)] > v_now - interval '60 seconds' then
        return 'cooldown';
    end if;

    update public.account_deletion_challenges set
        challenge_id = p_challenge_id, session_id = p_session_id,
        email = p_email, code_digest = p_code_digest,
        expires_at = v_now + interval '10 minutes', attempts = 0,
        request_times = array_append(v_recent, v_now)
    where user_id = p_user_id;
    return 'issued';
end;
$$;

-- Only the correct session/account/email/challenge can attempt verification.
-- Success consumes the challenge atomically; a fifth wrong attempt also clears it.
create function public.consume_account_deletion_challenge(
    p_user_id uuid, p_challenge_id uuid, p_session_id uuid, p_email text, p_code_digest text
) returns text
language plpgsql security invoker set search_path = ''
as $$
declare
    v_row public.account_deletion_challenges%rowtype;
    v_attempts integer;
begin
    if p_user_id is null or p_challenge_id is null or p_session_id is null
        or p_email is null or p_code_digest is null
        or p_code_digest !~ '^[0-9a-f]{64}$' then
        return 'invalid';
    end if;
    select * into v_row from public.account_deletion_challenges
    where user_id = p_user_id for update;
    if not found or v_row.code_digest is null
        or v_row.challenge_id is distinct from p_challenge_id
        or v_row.session_id is distinct from p_session_id
        or v_row.email is distinct from p_email then
        return 'invalid';
    end if;
    if v_row.expires_at <= clock_timestamp() then
        update public.account_deletion_challenges set challenge_id = null,
            session_id = null, email = null, code_digest = null, expires_at = null
        where user_id = p_user_id;
        return 'expired';
    end if;
    if v_row.code_digest = p_code_digest then
        update public.account_deletion_challenges set challenge_id = null,
            session_id = null, email = null, code_digest = null, expires_at = null
        where user_id = p_user_id;
        return 'consumed';
    end if;
    v_attempts := v_row.attempts + 1;
    if v_attempts >= 5 then
        update public.account_deletion_challenges set attempts = 5, challenge_id = null,
            session_id = null, email = null, code_digest = null, expires_at = null
        where user_id = p_user_id;
        return 'locked';
    end if;
    update public.account_deletion_challenges set attempts = v_attempts
    where user_id = p_user_id;
    return 'incorrect';
end;
$$;

-- Cancellation does not clear issuance history or bypass throttling.
create function public.cancel_account_deletion_challenge(
    p_user_id uuid, p_challenge_id uuid, p_session_id uuid
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
begin
    update public.account_deletion_challenges set challenge_id = null,
        session_id = null, email = null, code_digest = null, expires_at = null
    where user_id = p_user_id and challenge_id = p_challenge_id and session_id = p_session_id;
    return found;
end;
$$;

revoke all on function public.issue_account_deletion_challenge(uuid, uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.consume_account_deletion_challenge(uuid, uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.cancel_account_deletion_challenge(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.issue_account_deletion_challenge(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.consume_account_deletion_challenge(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.cancel_account_deletion_challenge(uuid, uuid, uuid) to service_role;
