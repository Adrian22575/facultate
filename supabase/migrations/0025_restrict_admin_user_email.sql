update public.admin_users
set is_active = false
where lower(trim(email)) <> 'agentiadiamond@gmail.com';
