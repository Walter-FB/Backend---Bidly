package com.bidly.bidly_backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "credenciales")
public class Credencial {
    @Id
    @Column(name = "cliente")
    private Long cliente;
    @Column(name = "email")
    private String email;
    @Column(name = "passwordhash")
    private String passwordHash;

    public Long getCliente() { return cliente; }
    public void setCliente(Long cliente) { this.cliente = cliente; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
}
