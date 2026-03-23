-- Allow authenticated IT users to manage nurse_profiles (approved submitters)
create policy "authenticated users can insert nurse_profiles"
  on nurse_profiles for insert
  to authenticated
  with check (true);

create policy "authenticated users can update nurse_profiles"
  on nurse_profiles for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can delete nurse_profiles"
  on nurse_profiles for delete
  to authenticated
  using (true);
