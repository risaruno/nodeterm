drop database if exists social;
create database social;
use social;

create table user(
	uid int not null auto_increment,
	username varchar(50) not null,
    password varchar(50) not null,
    primary key (uid)
);

insert into user (username, password) values
("user1","1234"),
("user2","1234"),
("user3","1234");

create table post (
	id int not null auto_increment,
    id_user int not null,
    content text not null,
    image varchar(250),
    created_at timestamp not null DEFAULT now(),
    edited_at timestamp not null DEFAULT now(),
    primary key (id),
    foreign key (id_user) references user(uid)
);

create table comment (
	cid int not null auto_increment,
    id_post int not null,
    id_user int not null,
    comment varchar(250) not null,
    created_at timestamp not null DEFAULT now(),
    primary key (cid),
    foreign key (id_post) references post(id),
    foreign key (id_user) references user(uid)
);