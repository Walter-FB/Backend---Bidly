package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.Seguro;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeguroRepository extends JpaRepository<Seguro, String> {
}
