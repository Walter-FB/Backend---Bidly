package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.Credencial;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface CredencialRepository extends JpaRepository<Credencial, Long> {
    Optional<Credencial> findByEmail(String email);
}
