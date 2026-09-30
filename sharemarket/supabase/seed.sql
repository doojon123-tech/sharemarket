-- schema.sql 실행 후 이 파일 실행
-- 관리자 권한 (테이블 정책은 users.is_admin 기준)
create policy "admin products" on products for all using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin));
create policy "admin groups" on groups for all using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin));
create policy "admin requests" on requests for update using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin));
-- 실시간 알림
alter publication supabase_realtime add table group_members;

insert into regions (name) values ('전남대학교'),('조선대학교'),('광주교육대학교');
insert into pickup_points (region_id, name, lat, lng)
select id, name || ' 정문 앞', null, null from regions;

insert into products (name,total_amount,unit,split_amount,total_price,image_url) values
('계란 30구',30,'구',10,8900,'🥚'),
('삼겹살 1kg',1000,'g',250,22000,'🥓'),
('쌀 10kg',10000,'g',2500,35000,'🍚'),
('두부 10모',10,'모',2,12000,'🧈'),
('라면 20봉',20,'봉',5,15000,'🍜'),
('닭가슴살 2kg',2000,'g',500,19800,'🍗'),
('우유 12팩',12,'팩',3,15000,'🥛'),
('양파 3kg',3000,'g',1000,6900,'🧅'),
('감자 5kg',5000,'g',1000,9900,'🥔'),
('냉동만두 2kg',2000,'g',500,13800,'🥟'),
('바나나 3kg',3000,'g',1000,7500,'🍌'),
('생수 2L 12병',12,'병',3,9600,'💧');
-- 관리자 지정: update users set is_admin = true where nickname = '내닉네임';
